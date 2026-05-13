<svelte:options namespace="svg" />

<script lang="ts">
  interface Props {
    cx: number;
    cy: number;
    rotation: number;
    locked: boolean;
    onclick: () => void;
  }

  let { cx, cy, rotation, locked, onclick }: Props = $props();
</script>

<g
  transform="translate({cx},{cy}) rotate({rotation.toFixed(1)})"
  cursor="pointer"
  style="transition: transform 0.08s ease-out"
  onclick={onclick}
  role="button"
  tabindex="0"
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') onclick(); }}
>
  {#if locked}
    <circle cx={0} cy={0} r={38} fill="none" stroke="#ff8844" stroke-width="2" stroke-dasharray="6,4" opacity="0.6" />
  {/if}
  <ellipse cx={0} cy={0} rx={28} ry={20}
    fill="rgba(30,30,60,0.6)"
    stroke={locked ? "#ff8844" : "#888"}
    stroke-width="2"
  />
  <line x1={-34} y1={-4} x2={34} y2={-4} stroke="#888" stroke-width="1.5" opacity="0.5" />
  <circle cx={-34} cy={-4} r={6} fill="#4a9eff" opacity="0.35" />
  <circle cx={34} cy={-4} r={6} fill="#ff4a4a" opacity="0.35" />
  <line x1={0} y1={-20} x2={0} y2={-55}
    stroke={locked ? "#ff8844" : "#66ff66"}
    stroke-width="2"
    marker-end={locked ? "url(#arrowO)" : "url(#arrowG)"}
  />
  <text x={0} y={5} text-anchor="middle" fill="#777" font-size="9" font-family="system-ui">BODY</text>
</g>
