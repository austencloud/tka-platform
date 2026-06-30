<!--
  PatternStripEditor.svelte
  Length × Rhythm × Amount over a PatternStepStrip. Strip is the source of truth;
  chips stamp + auto-highlight by derivation.
-->
<script lang="ts">
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import RhythmGlyph from "./RhythmGlyph.svelte";
  import PatternStepStrip from "./PatternStepStrip.svelte";
  import type { StripBinding, StripValue } from "./pattern-strip-types";
  import {
    divisorsUpTo, uniformActive, perHandRhythmMatches, singleLaneRhythmMatches,
    stampPerHand, stampSingle, resizePeriod,
  } from "$lib/shared/create/domain/rhythm/rhythm-mask";

  interface Props {
    binding: StripBinding;
    sequenceLength: number;
    /** Period-length lanes. lanes[0]=blue (or hold), lanes[1]=red. */
    value: StripValue[][];
    onChange: (lanes: StripValue[][]) => void;
    /** Optional per-lane, period-aligned "cell can't take effect" mask
     *  (reversals: beat isn't spinning). Lane order matches laneColors. */
    inertMask?: boolean[][];
  }
  let { binding, sequenceLength, value, onChange, inertMask }: Props = $props();

  const periods = $derived(divisorsUpTo(sequenceLength));
  const period = $derived(value[0]?.length ?? 1);
  const reps = $derived(sequenceLength / period);

  function setPeriod(p: number) {
    onChange(value.map((lane) => resizePeriod(lane, p, binding.base)));
  }
  /** Value stamped on active steps: a binary binding's fixed activeValue, else
   *  the lane's current uniform amount (falling back to the first amount). */
  function stampValue(li: number): StripValue {
    if (binding.activeValue !== undefined) return binding.activeValue;
    return (
      uniformActive(value[li] ?? [], binding.base) ??
      (binding.amountList?.[0] as StripValue)
    );
  }
  function laneAmount(li: number): StripValue | null {
    return uniformActive(value[li] ?? [], binding.base);
  }
  function applyAmount(li: number, a: number) {
    const lane = [...(value[li] ?? [])];
    const active = lane.map((v, i) => (v !== binding.base ? i : -1)).filter((i) => i >= 0);
    if (active.length === 0) lane.fill(a);
    else for (const i of active) lane[i] = a;
    const next = value.map((l, idx) => (idx === li ? lane : l));
    onChange(next);
  }
  type Rhythm = { id: string; label: string; sym: string; period?: number };
  /** A fixed-period rhythm is incompatible when the sequence length can't host it. */
  function rhythmDisabled(rhythm: Rhythm): boolean {
    return rhythm.period != null && sequenceLength % rhythm.period !== 0;
  }
  function rhythmActive(rhythm: Rhythm): boolean {
    // Fixed-period rhythms only light when the strip is at exactly that period.
    if (rhythm.period != null && period !== rhythm.period) return false;
    if (binding.lanes === 2)
      return perHandRhythmMatches(rhythm.sym, value[0] ?? [], value[1] ?? [], binding.base);
    return singleLaneRhythmMatches(rhythm.sym, value[0] ?? [], binding.base);
  }
  function applyRhythm(rhythm: Rhythm) {
    if (rhythmDisabled(rhythm)) return;
    // Fixed-period rhythms resize the strip to their period; tileable ones stamp
    // at the user's current period (unchanged behavior).
    const effPeriod = rhythm.period ?? period;
    if (binding.lanes === 2) {
      const { blue, red } = stampPerHand(
        rhythm, effPeriod, stampValue(0), stampValue(1), binding.base
      );
      onChange([blue, red]);
    } else {
      onChange([stampSingle(rhythm, effPeriod, stampValue(0), binding.base)]);
    }
  }
  function editCell(li: number, bi: number, v: StripValue) {
    const lane = [...(value[li] ?? [])];
    lane[bi] = v;
    onChange(value.map((l, idx) => (idx === li ? lane : l)));
  }

  const stripLanes = $derived(
    binding.laneLabels.map((label, i) => ({
      label,
      color: (binding.laneColors[i] === "accent" ? "hold" : binding.laneColors[i]) as "blue" | "red" | "hold",
      values: value[i] ?? [],
      inert: inertMask?.[i],
    })),
  );
</script>

<div class="pse">
  <div class="axis">
    <div class="axis-row">
      <span class="axis-lbl">Length</span>
      <span class="reps">×{reps} over {sequenceLength} beats</span>
    </div>
    <div class="seg-wrap">
      <SegmentedControl
        size="md" color="accent"
        options={periods.map((p) => ({ value: String(p), label: String(p) }))}
        value={String(period)}
        onchange={(v) => setPeriod(Number(v))}
      />
    </div>
  </div>

  <div class="axis">
    <div class="axis-lbl">Rhythm</div>
    <div class="chips">
      {#each binding.rhythms as r}
        <FilterChipBase
          label={r.label} mode="toggle" size="md"
          active={rhythmActive(r)} disabled={rhythmDisabled(r)}
          onclick={() => applyRhythm(r)}
        >
          {#snippet iconSnippet()}<RhythmGlyph sym={r.sym} lanes={binding.lanes} />{/snippet}
        </FilterChipBase>
      {/each}
    </div>
  </div>

  {#if binding.amountList}
    <div class="axis">
      <div class="axis-lbl">Amount</div>
      <div class="amt-grid">
        {#each binding.laneLabels as label, li}
          <div class="amt-row">
            <span class="amt-lane {binding.laneColors[li]}">{label}</span>
            <div class="seg-wrap">
              <SegmentedControl
                size="md" color={binding.laneColors[li]}
                options={binding.amountList.map((a) => ({ value: String(a), label: binding.format(a) }))}
                value={String(laneAmount(li) ?? -1)}
                onchange={(a) => applyAmount(li, Number(a))}
              />
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <div class="axis result">
    <div class="axis-lbl">Result</div>
    <PatternStepStrip
      lanes={stripLanes}
      cellKind={binding.cellKind ?? "number"}
      valueList={binding.valueList}
      base={binding.base}
      format={binding.format}
      onEdit={editCell}
    />
  </div>
</div>

<style>
  .pse { display: flex; flex-direction: column; gap: 26px; width: 100%; margin: 8px 0 0; }
  .axis-lbl { font-size: 13px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--theme-text-dim); }
  .axis > .axis-lbl { display: block; margin: 0 0 12px; }
  .axis-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 0 0 12px; }
  .reps { font-size: 12px; color: var(--theme-text-dim); font-variant-numeric: tabular-nums; }
  .chips { display: flex; flex-wrap: wrap; gap: 10px; }
  .amt-grid { display: flex; flex-direction: column; gap: 10px; }
  .amt-row { display: flex; align-items: center; gap: 12px; }
  .amt-lane { width: 44px; flex: 0 0 44px; font-size: 13px; font-weight: 800; }
  .amt-lane.blue { color: var(--theme-blue, #6f9bff); } .amt-lane.red { color: var(--theme-red, #ff7a8a); } .amt-lane.accent { color: var(--theme-accent, #2dd4bf); }
  .result { margin-top: 2px; }

  /* Cohesion: stop SegmentedControl stretching full-width; unify value type with the strip. */
  .seg-wrap { width: max-content; max-width: 100%; }
  :global(.pse .seg-wrap .segmented-control) { width: max-content; }
  :global(.pse .seg-wrap .segment) { min-width: 56px; padding: 0 16px; font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; }
</style>
