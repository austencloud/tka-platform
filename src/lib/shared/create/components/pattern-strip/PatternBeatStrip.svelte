<!--
  PatternBeatStrip.svelte
  The editable per-beat strip. One or two lanes. Number cells cycle a value list
  (left −, right +, center = popover); toggle cells flip on/off. Source of truth
  is owned by the parent; this emits edits.
-->
<script lang="ts" generics="T extends number | string | boolean">
  interface Lane {
    label: string;
    color: "blue" | "red" | "hold";
    values: T[];
  }
  interface Props {
    lanes: Lane[];
    cellKind: "number" | "toggle";
    /** Cycle list for number cells (left/right zones). */
    valueList?: T[];
    /** Base/default value rendered "muted". */
    base: T;
    format: (v: T) => string;
    onEdit: (laneIndex: number, beatIndex: number, value: T) => void;
  }
  let { lanes, cellKind, valueList = [], base, format, onEdit }: Props = $props();

  let popover = $state<{ lane: number; beat: number; x: number; y: number } | null>(null);

  function zone(e: MouseEvent, el: HTMLElement): -1 | 0 | 1 {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    return x <= 0.33 ? -1 : x >= 0.67 ? 1 : 0;
  }
  function step(current: T, dir: -1 | 1): T {
    let idx = valueList.findIndex((v) => String(v) === String(current));
    if (idx < 0) idx = 0;
    return valueList[Math.min(valueList.length - 1, Math.max(0, idx + dir))]!;
  }
  function onNumberClick(e: MouseEvent, li: number, bi: number, v: T, el: HTMLElement) {
    const z = zone(e, el);
    if (z === 0) {
      const r = el.getBoundingClientRect();
      popover = { lane: li, beat: bi, x: r.left, y: r.bottom + 8 };
    } else {
      onEdit(li, bi, step(v, z));
      popover = null;
    }
  }
  function pick(v: T) {
    if (popover) onEdit(popover.lane, popover.beat, v);
    popover = null;
  }
</script>

<svelte:window onclick={(e) => { if (!(e.target as HTMLElement)?.closest?.(".pbs-cell,.pbs-pop")) popover = null; }} />

<div class="pbs">
  {#each lanes as lane, li}
    <div class="pbs-lane">
      <span class="pbs-label {lane.color}">{lane.label}</span>
      <div class="pbs-beats">
        {#each lane.values as v, bi}
          {#if cellKind === "number"}
            <button
              class="pbs-cell num {lane.color}"
              class:muted={v === base}
              onclick={(e) => onNumberClick(e, li, bi, v, e.currentTarget)}
            >
              <span class="z minus"><i class="fa-solid fa-minus"></i></span>
              <span class="z plus"><i class="fa-solid fa-plus"></i></span>
              <span class="v">{format(v)}</span>
            </button>
          {:else}
            <button
              class="pbs-cell toggle {lane.color}"
              class:on={v !== base}
              role="switch"
              aria-checked={v !== base}
              aria-label="{lane.label} beat {bi + 1}"
              onclick={() => onEdit(li, bi, (v === base ? (valueList.find((x) => x !== base) ?? base) : base) as T)}
            >
              <i class="fa-solid fa-rotate"></i>
            </button>
          {/if}
        {/each}
      </div>
    </div>
  {/each}
</div>

{#if popover}
  {@const lane = lanes[popover.lane]!}
  <div class="pbs-pop" style="left:{popover.x}px; top:{popover.y}px">
    {#each valueList as v}
      <button class:sel={String(v) === String(lane.values[popover.beat])} onclick={() => pick(v)}>{format(v)}</button>
    {/each}
  </div>
{/if}

<style>
  .pbs { display: flex; flex-direction: column; gap: 12px; }
  .pbs-lane { display: flex; align-items: center; gap: 14px; }
  .pbs-label { width: 50px; flex: 0 0 50px; font-size: 13px; font-weight: 800; }
  .pbs-label.blue { color: var(--theme-blue, #6f9bff); }
  .pbs-label.red { color: var(--theme-red, #ff7a8a); }
  .pbs-label.hold { color: var(--theme-accent, #2dd4bf); }
  .pbs-beats { display: flex; gap: 8px; flex: 1; min-width: 0; }
  .pbs-cell {
    position: relative; flex: 1; min-width: 0; height: 56px; border-radius: 13px;
    border: 1px solid var(--theme-stroke); background: var(--theme-card-bg);
    color: var(--theme-text); cursor: pointer; overflow: hidden;
    display: flex; align-items: center; justify-content: center; user-select: none;
  }
  .pbs-cell .v { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; z-index: 2; pointer-events: none; }
  .pbs-cell.muted .v { color: var(--theme-text-dim); }
  .pbs-cell.num.blue:not(.muted) { background: color-mix(in srgb, var(--theme-blue, #6f9bff) 30%, var(--theme-card-bg)); }
  .pbs-cell.num.red:not(.muted) { background: color-mix(in srgb, var(--theme-red, #ff7a8a) 30%, var(--theme-card-bg)); }
  .pbs-cell.num.hold:not(.muted) { background: color-mix(in srgb, var(--theme-accent, #2dd4bf) 28%, var(--theme-card-bg)); }
  .pbs-cell.num:not(.muted) .v { color: #fff; }
  .pbs-cell .z {
    position: absolute; top: 0; bottom: 0; width: 50%; display: flex; align-items: center;
    opacity: 0; transition: opacity .12s; z-index: 1; color: var(--theme-text);
  }
  .pbs-cell .z.minus { left: 0; justify-content: flex-start; padding-left: 9px; }
  .pbs-cell .z.plus { right: 0; justify-content: flex-end; padding-right: 9px; }
  .pbs-cell:hover .z { opacity: .8; }
  .pbs-cell.toggle.on { background: color-mix(in srgb, var(--theme-blue, #6f9bff) 30%, var(--theme-card-bg)); color: #fff; }
  .pbs-cell.toggle.on.red { background: color-mix(in srgb, var(--theme-red, #ff7a8a) 30%, var(--theme-card-bg)); }
  .pbs-cell.toggle:not(.on) i { opacity: .32; }
  .pbs-pop {
    position: fixed; z-index: 50; display: grid; grid-template-columns: repeat(4, 54px); gap: 7px;
    background: var(--theme-panel-bg); border: 1px solid var(--theme-stroke); border-radius: 14px; padding: 10px;
    box-shadow: 0 18px 44px -16px rgba(0,0,0,.7);
  }
  .pbs-pop button {
    height: 46px; border-radius: 10px; border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg); color: var(--theme-text); font-weight: 700; font-size: 15px;
    cursor: pointer; font-variant-numeric: tabular-nums;
  }
  .pbs-pop button.sel { background: var(--theme-accent); color: #fff; border-color: transparent; }
</style>
