<script lang="ts">
  import { onMount } from "svelte";
  import { SIMPLE_PATTERNS } from "../domain/reversal-patterns";
  import { resolvePattern, type ResolvedReversalPattern } from "../domain/reversal-transform";

  interface Props {
    activePatternId: string | null;
    onPatternChange: (resolved: ResolvedReversalPattern) => void;
  }
  const { activePatternId, onPatternChange }: Props = $props();

  const STEPS = 4;
  let blue = $state<boolean[]>([false, false, false, false]);
  let red = $state<boolean[]>([false, false, false, false]);

  const resolved = $derived(resolvePattern(blue, red));

  function spinCW(hand: boolean[], step: number): boolean {
    let cw = true;
    for (let i = 0; i <= step; i++) if (hand[i]) cw = !cw;
    return cw;
  }

  function tile(sequence: string): { blue: boolean[]; red: boolean[] } {
    const b: boolean[] = [], r: boolean[] = [];
    for (let i = 0; i < STEPS; i++) {
      const sym = sequence[i % sequence.length];
      b.push(sym === "P" || sym === "B");
      r.push(sym === "P" || sym === "R");
    }
    return { blue: b, red: r };
  }

  function applyPreset(sequence: string) {
    const t = tile(sequence);
    blue = t.blue;
    red = t.red;
    emit();
  }

  function toggle(hand: "blue" | "red", step: number) {
    if (hand === "blue") blue[step] = !blue[step];
    else red[step] = !red[step];
    emit();
  }

  function emit() {
    onPatternChange(resolvePattern(blue, red));
  }

  // Apply the default (continuous) filter on mount so the family view starts
  // scoped to continuous catalogs rather than every reversal variant combined.
  onMount(emit);

  function charClass(ch: string): string {
    if (ch === "P") return "pair";
    if (ch === "B") return "blue-only";
    if (ch === "R") return "red-only";
    return "none";
  }
</script>

<div class="reversal-strip">
  <div class="preset-row" role="group" aria-label="Reversal presets">
    {#each SIMPLE_PATTERNS as p (p.id)}
      <button
        type="button"
        class="preset-chip"
        class:active={resolved.id === p.id}
        onclick={() => applyPreset(p.sequence)}
      >{p.label}</button>
    {/each}
  </div>

  <div class="timeline">
    {#each [{ key: "blue", arr: blue, label: "Blue" }, { key: "red", arr: red, label: "Red" }] as row (row.key)}
      <div class="row">
        <span class="row-label {row.key}">{row.label}</span>
        {#each row.arr as active, step (step)}
          <button
            type="button"
            role="switch"
            aria-pressed={active}
            aria-label="{row.label} reversal at step {step + 1}"
            class="cell {row.key}"
            class:active
            onclick={() => toggle(row.key as "blue" | "red", step)}
          >
            <span class="arrow" class:ccw={!spinCW(row.arr, step)}>↻</span>
            {#if active}<span class="rev">REV</span>{/if}
          </button>
        {/each}
      </div>
    {/each}
  </div>

  <div class="footer">
    <span class="pattern-string">
      {#each resolved.sequence.split("") as ch}
        <span class="pat {charClass(ch)}">{ch === "-" ? "—" : ch}</span>
      {/each}
    </span>
    <span class="badge" class:clean={resolved.isCleanLoop} class:broken={!resolved.isCleanLoop}>
      {resolved.isCleanLoop ? "Clean loop" : "Boundary discontinuity"}
    </span>
    <span class="label">{resolved.label}</span>
  </div>
</div>

<style>
  .reversal-strip {
    display: flex;
    flex-direction: column;
    gap: 14px;
    align-items: center;
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
    padding: 18px 20px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 14px;
  }

  .preset-row { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }

  .preset-chip {
    padding: 6px 12px;
    border-radius: 16px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font: inherit;
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
  }
  .preset-chip:hover { color: var(--theme-text, #fff); }
  .preset-chip.active {
    color: var(--theme-text, #fff);
    border-color: var(--tnd-accent-border, rgba(183, 99, 205, 0.5));
    background: var(--tnd-accent-bg, rgba(183, 99, 205, 0.15));
  }

  .timeline { display: flex; flex-direction: column; gap: 6px; }
  .row { display: flex; align-items: center; gap: 6px; }

  .row-label { width: 42px; text-align: right; font-size: 12px; font-weight: 600; padding-right: 6px; }
  .row-label.blue { color: var(--prop-blue, #3498db); }
  .row-label.red { color: var(--prop-red, #e74c3c); }

  .cell {
    width: 56px;
    height: 52px;
    border-radius: 8px;
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    background: rgba(255, 255, 255, 0.02);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .cell:hover { border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2)); }
  .cell.blue.active { background: rgba(52, 152, 219, 0.22); border-color: rgba(52, 152, 219, 0.6); color: #fff; }
  .cell.red.active { background: rgba(231, 76, 60, 0.22); border-color: rgba(231, 76, 60, 0.6); color: #fff; }
  .cell:focus-visible { outline: 2px solid var(--theme-accent, #6c8ee8); outline-offset: 2px; }

  .arrow { font-size: 20px; transition: transform 0.2s ease; display: inline-block; }
  .arrow.ccw { transform: scaleX(-1); }
  .rev { font-size: 8px; letter-spacing: 0.05em; font-weight: 600; }

  .footer { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: center; }

  .pattern-string { font-family: var(--font-mono, monospace); font-size: 16px; letter-spacing: 5px; display: inline-flex; }
  .pat { min-width: 16px; text-align: center; }
  .pat.pair { color: #c084fc; }
  .pat.blue-only { color: var(--prop-blue, #3498db); }
  .pat.red-only { color: var(--prop-red, #e74c3c); }
  .pat.none { color: var(--theme-text-muted, rgba(255, 255, 255, 0.3)); }

  .badge { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 12px; }
  .badge.clean { color: #4ade80; background: rgba(74, 222, 128, 0.15); }
  .badge.broken { color: #facc15; background: rgba(250, 204, 21, 0.15); }

  .label { font-size: 12px; color: var(--theme-text-muted, rgba(255, 255, 255, 0.5)); }

  @media (prefers-reduced-motion: reduce) {
    .preset-chip, .cell, .arrow { transition: none; }
  }
</style>
