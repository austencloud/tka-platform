<!--
  PerformerRing — the schematic, countable cast of a tunnel config.

  A tiny inline SVG: one blue+red hand-dot pair per performer (= per rendered
  copy), placed around a ring. Fold spaces the base performers; Mirror/Flip each
  seat a reflected twin on a tighter concentric ring, so every one of the
  `imageCount` copies is a distinct, countable dot-pair. Changing a count-builder
  springs twins in/out; a motion toggle changes nothing here (its dots never
  appear), which is the "motion is free" teaching moment.

  Sibling of card-back/StartPositionMiniGrid (same blue/red hand convention);
  count/twin structure comes from performer-ring-model.
-->
<script lang="ts">
  import { browser } from "$app/environment";
  import { scale } from "svelte/transition";
  import type { TunnelConfig } from "./tunnel-config";
  import { performerRing, depthRadiusFraction } from "./performer-ring-model";

  let {
    config,
    size = 96,
    animate = true,
  }: { config: TunnelConfig; size?: number; animate?: boolean } = $props();

  const HAND_BLUE = "#2E86DE";
  const HAND_RED = "#E74C3C";

  const reduced = $derived(
    browser && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const dur = $derived(animate && !reduced ? 260 : 0);

  const cx = $derived(size / 2);
  const cy = $derived(size / 2);
  const ringR = $derived(size * 0.4);
  const endR = $derived(size * 0.036); // blue/red hand cap radius
  const staffHalf = $derived(size * 0.06); // half the staff body length

  const performers = $derived(performerRing(config));

  /** Center of one performer on the ring. */
  function centerOf(angleDeg: number, depth: number) {
    const a = (angleDeg * Math.PI) / 180;
    const r = ringR * depthRadiusFraction(depth);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), a };
  }

  /** One performer = a little staff: a bar with a blue end and a red end,
   *  laid tangent to the ring. Count staves = performers; count ends = props. */
  function hands(angleDeg: number, depth: number) {
    const c = centerOf(angleDeg, depth);
    const tx = -Math.sin(c.a);
    const ty = Math.cos(c.a);
    return {
      blue: { x: c.x + tx * staffHalf, y: c.y + ty * staffHalf },
      red: { x: c.x - tx * staffHalf, y: c.y - ty * staffHalf },
    };
  }
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 {size} {size}"
  xmlns="http://www.w3.org/2000/svg"
  role="img"
  aria-label="{performers.length} performers"
>
  <!-- Guide ring + center -->
  <circle
    cx={cx}
    cy={cy}
    r={ringR}
    fill="none"
    stroke="var(--theme-stroke, rgba(255,255,255,0.12))"
    stroke-width="1"
  />
  <circle cx={cx} cy={cy} r={size * 0.03} fill="var(--theme-stroke, rgba(255,255,255,0.25))" />

  {#each performers as p (p.id)}
    {@const h = hands(p.angleDeg, p.depth)}
    {@const c = centerOf(p.angleDeg, p.depth)}
    <g
      class="performer"
      style="transform-box: fill-box; transform-origin: center;"
      transition:scale={{ duration: dur, start: 0.3 }}
    >
      {#if p.id === "f0"}
        <!-- The base performer ("you") — the seed everything multiplies from. -->
        <circle
          cx={c.x}
          cy={c.y}
          r={staffHalf + endR + size * 0.02}
          fill="none"
          stroke="var(--theme-accent, #c79bff)"
          stroke-width="1.5"
          opacity="0.9"
        />
      {/if}
      <!-- Staff body -->
      <line
        x1={h.blue.x}
        y1={h.blue.y}
        x2={h.red.x}
        y2={h.red.y}
        stroke="var(--theme-text-dim, rgba(255,255,255,0.5))"
        stroke-width={endR * 0.9}
        stroke-linecap="round"
      />
      <!-- Hand ends -->
      <circle cx={h.blue.x} cy={h.blue.y} r={endR} fill={HAND_BLUE} />
      <circle cx={h.red.x} cy={h.red.y} r={endR} fill={HAND_RED} />
    </g>
  {/each}
</svg>

<style>
  svg {
    display: block;
    overflow: visible;
  }
  .performer :global(circle) {
    /* Subtle seat so overlapping twins on tighter rings stay legible. */
    stroke: var(--theme-bg-deep, #0a0a14);
    stroke-width: 0.5;
  }
</style>
