<svelte:options namespace="svg" />

<script lang="ts">
  interface Props {
    x: number;
    y: number;
    label: string;
    color: string;
  }

  let { x, y, label, color }: Props = $props();
</script>

<g cursor="grab">
  <circle cx={x} cy={y} r={15} fill={color} opacity="0.9" />
  <text
    {x} y={y + 5}
    text-anchor="middle" fill="#fff" font-size="12" font-weight="bold"
    font-family="system-ui" pointer-events="none"
  >{label}</text>
</g>
