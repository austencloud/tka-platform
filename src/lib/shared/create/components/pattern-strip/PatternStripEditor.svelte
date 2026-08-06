<!--
  PatternStripEditor.svelte
  Length × Rhythm × Amount over a PatternStepStrip. Strip is the source of truth;
  chips stamp + auto-highlight by derivation.
-->
<script lang="ts">
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import RhythmGlyph from "./RhythmGlyph.svelte";
  import PatternStepStrip from "./PatternStepStrip.svelte";
  import type { StripBinding, StripValue } from "./pattern-strip-types";
  import {
    divisorsUpTo,
    uniformActive,
    perHandRhythmMatches,
    singleLaneRhythmMatches,
    stampPerHand,
    stampSingle,
    resizePeriod,
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
    /** Reflows the controls into horizontal rows when a wide, short drawer
     *  provides less height than the standard stacked editor needs. */
    fitAvailableHeight?: boolean;
    /** Lets a parent drill-down give one editing axis the whole surface. */
    visibleAxis?: "all" | "length" | "rhythm" | "amount" | "result";
  }
  let {
    binding,
    sequenceLength,
    value,
    onChange,
    inertMask,
    fitAvailableHeight = false,
    visibleAxis = "all",
  }: Props = $props();

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
    const active = lane
      .map((v, i) => (v !== binding.base ? i : -1))
      .filter((i) => i >= 0);
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
      return perHandRhythmMatches(
        rhythm.sym,
        value[0] ?? [],
        value[1] ?? [],
        binding.base
      );
    return singleLaneRhythmMatches(rhythm.sym, value[0] ?? [], binding.base);
  }
  function applyRhythm(rhythm: Rhythm) {
    if (rhythmDisabled(rhythm)) return;
    // Fixed-period rhythms resize the strip to their period; tileable ones stamp
    // at the user's current period (unchanged behavior).
    const effPeriod = rhythm.period ?? period;
    if (binding.lanes === 2) {
      const { blue, red } = stampPerHand(
        rhythm,
        effPeriod,
        stampValue(0),
        stampValue(1),
        binding.base
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
      color: (binding.laneColors[i] === "accent"
        ? "hold"
        : binding.laneColors[i]) as "blue" | "red" | "hold",
      values: value[i] ?? [],
      inert: inertMask?.[i],
    }))
  );
</script>

<div
  class="pse"
  class:fit-available-height={fitAvailableHeight}
  class:single-lane={binding.lanes === 1}
  class:solo-axis={visibleAxis !== "all"}
>
  {#if visibleAxis === "all" || visibleAxis === "length"}
    <div class="axis">
      <div class="axis-row">
        <span class="axis-lbl">Length</span>
        <span class="reps">×{reps} over {sequenceLength} steps</span>
      </div>
      <div class="seg-wrap">
        <SegmentedControl
          size="md"
          color="accent"
          options={periods.map((p) => ({ value: String(p), label: String(p) }))}
          value={String(period)}
          onchange={(v) => setPeriod(Number(v))}
        />
      </div>
    </div>
  {/if}

  {#if visibleAxis === "all" || visibleAxis === "rhythm"}
    <div class="axis">
      <div class="axis-lbl">Rhythm</div>
      <div class="chips">
        {#each binding.rhythms as r}
          <FilterChipBase
            label={r.label}
            mode="toggle"
            size="md"
            active={rhythmActive(r)}
            disabled={rhythmDisabled(r)}
            onclick={() => applyRhythm(r)}
          >
            {#snippet iconSnippet()}<RhythmGlyph
                sym={r.sym}
                lanes={binding.lanes}
              />{/snippet}
          </FilterChipBase>
        {/each}
      </div>
    </div>
  {/if}

  {#if binding.amountList && (visibleAxis === "all" || visibleAxis === "amount")}
    <div class="axis">
      <div class="axis-lbl">Amount</div>
      <div class="amt-grid">
        {#each binding.laneLabels as label, li}
          <div class="amt-row">
            <span class="amt-lane {binding.laneColors[li]}">{label}</span>
            <div class="seg-wrap">
              <SegmentedControl
                size="md"
                color={binding.laneColors[li]}
                options={binding.amountList.map((a) => ({
                  value: String(a),
                  label: binding.format(a),
                }))}
                value={String(laneAmount(li) ?? -1)}
                onchange={(a) => applyAmount(li, Number(a))}
              />
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if visibleAxis === "all" || visibleAxis === "result"}
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
  {/if}
</div>

<style>
  .pse {
    display: flex;
    flex-direction: column;
    gap: 26px;
    width: 100%;
    margin: 8px 0 0;
  }
  .axis-lbl {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--theme-text-dim);
  }
  .axis > .axis-lbl {
    display: block;
    margin: 0 0 12px;
  }
  .axis-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin: 0 0 12px;
  }
  .reps {
    font-size: 12px;
    color: var(--theme-text-dim);
    font-variant-numeric: tabular-nums;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .amt-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .amt-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .amt-lane {
    width: 44px;
    flex: 0 0 44px;
    font-size: 13px;
    font-weight: 800;
  }
  .amt-lane.blue {
    color: var(--theme-blue, #6f9bff);
  }
  .amt-lane.red {
    color: var(--theme-red, #ff7a8a);
  }
  .amt-lane.accent {
    color: var(--theme-accent, #2dd4bf);
  }
  .result {
    margin-top: 2px;
  }

  /* One axis on its own screen: the drill-down header already names it, so the
     duplicate LENGTH / RHYTHM / RESULT caption goes, and the meta line ("×10
     over 40 steps") slides back under the heading it belongs to. */
  .solo-axis .axis-lbl {
    display: none;
  }

  /* With the caption gone the meta line ("×10 over 40 steps") is no longer a
     heading — it is the consequence of the choice, so it moves under the
     control. Axes with a single visible child are unaffected by the reverse. */
  .solo-axis .axis {
    display: flex;
    flex-direction: column-reverse;
  }

  .solo-axis .axis-row {
    justify-content: flex-start;
    margin: 8px 0 0;
  }

  /* Cohesion: stop SegmentedControl stretching full-width; unify value type with the strip. */
  .seg-wrap {
    width: max-content;
    max-width: 100%;
  }
  :global(.pse .seg-wrap .segmented-control) {
    width: max-content;
  }
  :global(.pse .seg-wrap .segment) {
    min-width: 56px;
    padding: 0 16px;
    font-size: 16px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  /* A narrow portrait drawer cannot spend 26px between every editing axis.
     This keeps the phone composition vertical and readable while reclaiming
     enough height for Result and the persistent Apply action below it. */
  @container sequence-action-subview (max-width: 599px) and (max-height: 430px) {
    .pse.fit-available-height {
      gap: 10px;
      margin: 0;
    }

    .pse.fit-available-height .axis-row,
    .pse.fit-available-height .axis > .axis-lbl {
      margin-bottom: 6px;
    }

    .pse.fit-available-height .chips,
    .pse.fit-available-height .amt-grid {
      gap: 6px;
    }

    .pse.fit-available-height .amt-row {
      gap: 6px;
    }

    .pse.fit-available-height .seg-wrap :global(.segment) {
      min-width: var(--min-touch-target, 44px);
      padding-inline: 10px;
      font-size: var(--font-size-sm, 14px);
    }

    .pse.fit-available-height .chips :global(.filter-chip) {
      min-height: var(--min-touch-target, 44px);
      padding-inline: 8px;
      gap: 4px;
    }

    .pse.fit-available-height .result {
      margin-top: 0;
    }
  }

  /* A foldable portrait drawer is wide enough for full controls but only about
     half a screen tall. Keep every target at least 44px and use that width to
     put each editing axis on one row, so Result and Apply stay visible. */
  @container sequence-action-subview (min-width: 600px) and (max-height: 540px) {
    .pse.fit-available-height {
      gap: 4px;
      margin: 0;
    }

    .pse.fit-available-height > .axis {
      display: grid;
      grid-template-columns: 4rem minmax(0, 1fr);
      align-items: center;
      gap: 8px;
      min-width: 0;
      margin: 0;
    }

    .pse.fit-available-height > .axis:first-child {
      grid-template-columns: minmax(0, 1fr) max-content;
    }

    .pse.fit-available-height .axis-row {
      margin: 0;
    }

    .pse.fit-available-height .axis > .axis-lbl {
      margin: 0;
    }

    .pse.fit-available-height .chips {
      flex-wrap: nowrap;
      gap: 6px;
      min-width: 0;
    }

    .pse.fit-available-height .chips :global(.filter-chip) {
      min-width: 0;
      padding: 6px 4px;
      gap: 2px;
    }

    .pse.fit-available-height .amt-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      min-width: 0;
    }

    .pse.fit-available-height.single-lane .amt-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .pse.fit-available-height .amt-row {
      gap: 4px;
      min-width: 0;
    }

    .pse.fit-available-height .amt-lane {
      width: 2rem;
      flex-basis: 2rem;
    }

    .pse.fit-available-height .seg-wrap :global(.segment) {
      min-width: 42px;
      padding-inline: 8px;
      font-size: var(--font-size-sm, 14px);
    }

    .pse.fit-available-height .result {
      margin: 0;
    }

    .pse.fit-available-height .result :global(.pbs) {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .pse.fit-available-height.single-lane .result :global(.pbs) {
      grid-template-columns: minmax(0, 1fr);
    }

    .pse.fit-available-height .result :global(.pbs-lane) {
      gap: 4px;
      min-width: 0;
    }

    .pse.fit-available-height .result :global(.pbs-label) {
      width: 2rem;
      flex-basis: 2rem;
    }

    .pse.fit-available-height .result :global(.pbs-steps) {
      gap: 4px;
    }

    .pse.fit-available-height .result :global(.pbs-cell) {
      height: var(--min-touch-target, 44px);
      border-radius: 8px;
    }

    .pse.fit-available-height .result :global(.pbs-cell .v) {
      font-size: var(--font-size-sm, 14px);
    }
  }
</style>
