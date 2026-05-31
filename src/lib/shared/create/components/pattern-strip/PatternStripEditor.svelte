<!--
  PatternStripEditor.svelte
  Length × Rhythm × Amount over a PatternBeatStrip. Strip is the source of truth;
  chips stamp + auto-highlight by derivation.
-->
<script lang="ts">
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import RhythmGlyph from "./RhythmGlyph.svelte";
  import PatternBeatStrip from "./PatternBeatStrip.svelte";
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
  }
  let { binding, sequenceLength, value, onChange }: Props = $props();

  const periods = $derived(divisorsUpTo(sequenceLength));
  const period = $derived(value[0]?.length ?? 1);
  const reps = $derived(sequenceLength / period);

  function setPeriod(p: number) {
    onChange(value.map((lane) => resizePeriod(lane, p, binding.base)));
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
  function rhythmActive(sym: string): boolean {
    if (binding.lanes === 2)
      return perHandRhythmMatches(sym, value[0] ?? [], value[1] ?? [], binding.base);
    return singleLaneRhythmMatches(sym, value[0] ?? [], binding.base);
  }
  function applyRhythm(sym: string, rhythm: { id: string; label: string; sym: string }) {
    if (binding.lanes === 2) {
      const bAmt = uniformActive(value[0] ?? [], binding.base) ?? (binding.amountList[0] as StripValue);
      const rAmt = uniformActive(value[1] ?? [], binding.base) ?? (binding.amountList[0] as StripValue);
      const { blue, red } = stampPerHand(rhythm, period, bAmt, rAmt, binding.base);
      onChange([blue, red]);
    } else {
      const amt = uniformActive(value[0] ?? [], binding.base) ?? (binding.amountList[0] as StripValue);
      onChange([stampSingle(rhythm, period, amt, binding.base)]);
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
    })),
  );
</script>

<div class="pse">
  <div class="axis">
    <div class="axis-lbl">Length <span class="hint">— pattern period</span></div>
    <div class="seg-row">
      <SegmentedControl
        size="sm" color="accent"
        options={periods.map((p) => ({ value: String(p), label: String(p) }))}
        value={String(period)}
        onchange={(v) => setPeriod(Number(v))}
      />
      <span class="reps">repeats <b>×{reps}</b> across {sequenceLength} beats</span>
    </div>
  </div>

  <div class="axis">
    <div class="axis-lbl">Rhythm <span class="hint">— which beats are active</span></div>
    <div class="chips">
      {#each binding.rhythms as r}
        <FilterChipBase
          label={r.label} mode="toggle" size="sm" active={rhythmActive(r.sym)}
          onclick={() => applyRhythm(r.sym, r)}
        >
          {#snippet iconSnippet()}<RhythmGlyph sym={r.sym} lanes={binding.lanes} />{/snippet}
        </FilterChipBase>
      {/each}
    </div>
  </div>

  <div class="axis">
    <div class="axis-lbl">Amount <span class="hint">— value on active beats</span></div>
    <div class="amt-grid">
      {#each binding.laneLabels as label, li}
        <div class="amt-row">
          <span class="amt-lane {binding.laneColors[li]}">{label}</span>
          <SegmentedControl
            size="sm" color={binding.laneColors[li]}
            options={binding.amountList.map((a) => ({ value: String(a), label: binding.format(a) }))}
            value={String(laneAmount(li) ?? -1)}
            onchange={(a) => applyAmount(li, Number(a))}
          />
        </div>
      {/each}
    </div>
  </div>

  <div class="axis result">
    <div class="axis-lbl">Result <span class="hint">— edit freely; chips light when matched</span></div>
    <PatternBeatStrip
      lanes={stripLanes}
      cellKind="number"
      valueList={binding.valueList}
      base={binding.base}
      format={binding.format}
      onEdit={editCell}
    />
  </div>
</div>

<style>
  .pse { display: flex; flex-direction: column; gap: 18px; }
  .axis-lbl { font-size: 12px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--theme-text-dim); margin: 0 0 10px; }
  .axis-lbl .hint { font-weight: 500; letter-spacing: 0; text-transform: none; }
  .seg-row { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
  .reps { font-size: 12.5px; color: var(--theme-text-dim); } .reps b { color: var(--theme-text); font-variant-numeric: tabular-nums; }
  .chips { display: flex; flex-wrap: wrap; gap: 10px; }
  .amt-grid { display: flex; flex-direction: column; gap: 9px; }
  .amt-row { display: flex; align-items: center; gap: 13px; }
  .amt-lane { width: 42px; flex: 0 0 42px; font-size: 13px; font-weight: 800; }
  .amt-lane.blue { color: var(--theme-blue, #6f9bff); } .amt-lane.red { color: var(--theme-red, #ff7a8a); } .amt-lane.accent { color: var(--theme-accent, #2dd4bf); }
  .result { margin-top: 4px; }
</style>
