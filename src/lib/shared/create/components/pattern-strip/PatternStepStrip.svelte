<!--
  PatternStepStrip.svelte
  The editable per-step strip. One or two lanes. Number cells cycle a value list
  (left −, right +, center = popover); toggle cells flip on/off. Source of truth
  is owned by the parent; this emits edits.
-->
<script lang="ts" generics="T extends number | string | boolean">
  interface Lane {
    label: string;
    color: "blue" | "red" | "hold";
    values: T[];
    /** Per-cell "this cell can't take effect" mask (reversals: step isn't
     *  spinning). Aligned to `values`. Renders the cell dimmed + dashed. */
    inert?: boolean[];
  }
  interface Props {
    lanes: Lane[];
    cellKind: "number" | "toggle";
    /** Cycle list for number cells (left/right zones). */
    valueList?: T[];
    /** Base/default value rendered "muted". */
    base: T;
    format: (v: T) => string;
    onEdit: (laneIndex: number, stepIndex: number, value: T) => void;
    /** Step the cells up from the inline 56px row to a size that reads at arm's
     *  length. For a roomy pane, where the small row looks lost. */
    fill?: boolean;
    /** Number the columns above the lanes. Turns "on steps 2 and 4" from a claim
     *  into something you can check by looking. */
    showStepNumbers?: boolean;
  }
  let {
    lanes,
    cellKind,
    valueList = [],
    base,
    format,
    onEdit,
    fill = false,
    showStepNumbers = false,
  }: Props = $props();

  let popover = $state<{ lane: number; step: number; x: number; y: number } | null>(null);

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
  function openPopover(li: number, bi: number, el: HTMLElement) {
    const r = el.getBoundingClientRect();
    popover = { lane: li, step: bi, x: r.left, y: r.bottom + 8 };
  }
  function onNumberClick(e: MouseEvent, li: number, bi: number, v: T, el: HTMLElement) {
    // Keyboard activation (Enter/Space) fires a click with detail === 0 and
    // clientX/clientY === 0, which the clientX-based zone() always reads as the
    // left ("−") zone. Route keyboard activation to the popover so keyboard
    // users can reach the full value list instead of only ever decrementing.
    if (e.detail === 0) {
      openPopover(li, bi, el);
      return;
    }
    const z = zone(e, el);
    if (z === 0) {
      openPopover(li, bi, el);
    } else {
      onEdit(li, bi, step(v, z));
      popover = null;
    }
  }
  function pick(v: T) {
    if (popover) onEdit(popover.lane, popover.step, v);
    popover = null;
  }
</script>

<svelte:window onclick={(e) => { if (!(e.target as HTMLElement)?.closest?.(".pbs-cell,.pbs-pop")) popover = null; }} />

<div class="pbs" class:fill>
  {#if showStepNumbers}
    <!-- Decorative: every cell already carries its own step in its aria-label,
         so a screen reader reading this row too would just say the numbers
         twice. -->
    <div class="pbs-lane pbs-nums" aria-hidden="true">
      <span class="pbs-label"></span>
      <div class="pbs-steps">
        {#each lanes[0]?.values ?? [] as _, i}
          <span class="pbs-num">{i + 1}</span>
        {/each}
      </div>
    </div>
  {/if}
  {#each lanes as lane, li}
    <div class="pbs-lane">
      <span class="pbs-label {lane.color}">{lane.label}</span>
      <div class="pbs-steps">
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
              class:inert={lane.inert?.[bi]}
              role="switch"
              aria-checked={v !== base}
              aria-label="{lane.label} step {bi + 1}{lane.inert?.[bi] ? ' (no spin, reversal has no effect)' : ''}"
              title={lane.inert?.[bi]
                ? "This step isn't spinning, so a reversal here has no effect"
                : undefined}
              onclick={() => onEdit(li, bi, (v === base ? (valueList.find((x) => x !== base) ?? base) : base) as T)}
            >
              <i class="fa-solid {lane.inert?.[bi] ? 'fa-ban' : 'fa-rotate'}"></i>
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
      <button class:sel={String(v) === String(lane.values[popover.step])} onclick={() => pick(v)}>{format(v)}</button>
    {/each}
  </div>
{/if}

<style>
  .pbs { display: flex; flex-direction: column; gap: 10px; }
  .pbs-lane { display: flex; align-items: center; gap: 12px; }
  /* Sized to the longest label ("Right") rather than to a round number of
     pixels. At 44px the bold text ran past its own box and collided with the
     first cell; ch tracks the font, and the clamp is the backstop for a lane
     name longer than the two this ships with. */
  .pbs-label {
    width: 5ch; flex: 0 0 5ch; min-width: 0;
    font-size: 14px; font-weight: 800;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .pbs-label.blue { color: var(--theme-blue, #6f9bff); }
  .pbs-label.red { color: var(--theme-red, #ff7a8a); }
  .pbs-label.hold { color: var(--theme-accent, #2dd4bf); }
  .pbs-steps { display: flex; gap: 10px; flex: 1; min-width: 0; }
  .pbs-cell {
    position: relative; flex: 1; min-width: 0; height: 56px; border-radius: 12px;
    border: 1px solid var(--theme-stroke); background: var(--theme-card-bg);
    color: var(--theme-text); cursor: pointer; overflow: hidden;
    display: flex; align-items: center; justify-content: center; user-select: none;
  }
  /* Fill mode: the same strip in a roomy pane, where the inline 56px row looks
     lost. Only the CELLS grow — the strip takes its natural height and hands
     the leftover back to the parent, which has something better to do with it
     than stretch two rows of tokens across a third of a screen.

     Every other arrangement was tried and looked worse: an uncapped cell became
     a 505x342px black slab at a period of 1, capping the cell while the lane
     still stretched parked the two lanes ~317px apart with nothing between
     them, and letting the box claim the height left a hole inside the Result
     panel. A cell holds one short value; past about 5.5rem it stops reading as
     a token, in either direction.

     `0 0 auto` and not `1` (which is `1 1 0`): on a short landscape phone the
     pane is shorter than the panel wants, and a shrinkable strip collapsed to
     nothing while its cells kept painting at full size — the bottom lane ran
     off the screen with no scroll able to reach it, because a collapsed flex
     item contributes no height for the scroller to find. */
  .pbs.fill { flex: 1 0 auto; }
  /* The lane is a row of cells beside a name. Stretching it gives the cells a
     definite height to grow into; the name stays centred against them, and the
     number ruler keeps its own small height rather than sharing the lanes'. */
  .pbs.fill .pbs-lane { flex: 1 1 auto; min-height: 0; align-items: stretch; }
  .pbs.fill .pbs-label { align-self: center; }
  .pbs.fill .pbs-nums { flex: 0 0 auto; }
  /* Height comes entirely from the lane, with no ceiling of its own. A ceiling
     here is what turns a roomy panel into a void: the panel takes the height,
     the cell refuses it, and the difference is black. The panel is the thing
     that gets bounded (see PatternStripEditor's sentence-mode block), and
     whatever it settles on, the cells fill exactly. Width still stops at
     5.5rem — a cell holds one short value, and past that it stops reading as a
     token. */
  .pbs.fill .pbs-cell {
    height: 100%;
    min-height: 56px;
    max-width: 5.5rem;
  }

  /* The column header. Sized and spaced exactly like the cell row beneath it so
     each number sits over its own cell — a ruler, not a caption. */
  .pbs-nums { margin-bottom: -2px; }
  .pbs-num {
    flex: 1; min-width: 0; text-align: center;
    font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums;
    color: var(--theme-text-dim); letter-spacing: 0.02em;
  }
  .pbs.fill .pbs-num { max-width: 5.5rem; }
  .pbs-cell .v { font-size: 17px; font-weight: 600; font-variant-numeric: tabular-nums; z-index: 2; pointer-events: none; }
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

  /* Inert: this step doesn't spin, so a reversal here can't act. Dashed + dim,
     and an "on" toggle here drops its bright fill to read as having no effect. */
  .pbs-cell.inert { border-style: dashed; opacity: .55; }
  .pbs-cell.toggle.on.inert { background: var(--theme-card-bg); color: var(--theme-text-dim); }
  .pbs-cell.inert i { opacity: .5; }
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
